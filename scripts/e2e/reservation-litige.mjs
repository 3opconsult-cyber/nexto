// Réservation directe (acceptée / refusée, 052) puis litiges (054) sur la PROD, comptes audit, appels de base (RPC) :
//   C1 refus · C2 acceptation · D litige + paiement bloqué + arrangement à l'amiable + avoir · E intervention de PING demandée.
// La décision de PING (admin) n'est pas jouée ici : elle demande un compte admin.
//   TA=<mission A terminée> TB=<mission B terminée> node reservation-litige.mjs   (depuis un dossier avec @supabase/supabase-js)
// Écrit en base (comptes audit) : 2 réservations « QA scénario C », 2 litiges « QA scénario D/E ». Nettoyage : nettoyage_tests_qa_*.sql.
import { createClient } from '@supabase/supabase-js'
const SB=['https://wmiawwaxwlvascyflpba.supabase.co','sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP']
const PID='b9f8cd9a-16de-4a36-afd8-10a2135ab970', PWD='AuditPing2026!'
const login=async e=>{const c=createClient(...SB,{auth:{persistSession:false}});const {error}=await c.auth.signInWithPassword({email:e,password:PWD});if(error)throw error;return c}
const cl=await login('audit.client.claude@ping-demo.invalid'), pro=await login('audit.pro.claude@ping-demo.invalid')
const out=[]; const log=(k,v,ok)=>{out.push([ok?'OK':'KO',k,JSON.stringify(v)].join(' '));console.log(out.at(-1))}

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const book=async(addr)=>cl.rpc('book_service',{p_provider:PID,p_service:null,p_mode:'forfait',p_estimated_hours:null,p_address:'2 rue de l Audit, Grasse',p_address_status:'profil',p_scheduled_at:new Date(Date.now()+48*3600e3).toISOString(),p_description:'QA scénario C '+addr,p_lat:null,p_lng:null,p_payment_pref:null})
// C1 : réservation directe -> en attente -> REFUS
let r=await book('refus'); log('C1 réservation directe créée « en attente »',r.error?.message||r.data,!r.error&&r.data?.booking_status==='en_attente')
const t1=r.data?.transaction_id
if(t1){
  let x=await pro.rpc('refuse_booking',{p_transaction:t1,p_reason:'QA : indisponible'}); log('C1 le prestataire refuse',x.error?.message||x.data,!x.error)
  let {data:t}=await cl.from('transactions').select('booking_status,status,price_confirmed').eq('id',t1).single(); log('C1 état en base',t,t?.booking_status==='refusee')
  let {data:m}=await cl.from('messages').select('body,kind').eq('transaction_id',t1); log('C1 message au client',m?.map(z=>z.body?.slice(0,80)),(m||[]).length>0)
  let y=await pro.rpc('accept_booking',{p_transaction:t1}); log('C1 on ne peut plus accepter une réservation refusée',y.data,y.data?.ok===false)
}
// C2 : réservation -> ACCEPTATION
r=await book('accept'); log('C2 réservation directe créée « en attente »',r.error?.message||r.data,!r.error&&r.data?.booking_status==='en_attente')
const t2=r.data?.transaction_id
if(t2){
  let {data:b}=await pro.from('transactions').select('requests(address)').eq('id',t2).single(); log('C2 (limite connue) adresse lisible en base avant acceptation : le masquage est applicatif',b?.requests,true)
  let x=await pro.rpc('accept_booking',{p_transaction:t2}); log('C2 le prestataire accepte',x.error?.message||x.data,!x.error)
  let {data:t}=await cl.from('transactions').select('booking_status,price_confirmed').eq('id',t2).single(); log('C2 état en base',t,t?.booking_status==='acceptee'&&t?.price_confirmed)
  let {data:b2}=await pro.from('transactions').select('requests(address)').eq('id',t2).single(); log('C2 adresse visible après acceptation',b2?.requests,!!b2?.requests?.address)
    await cl.from('transactions').update({status:'cancelled'}).eq('id',t2)
}
console.log(out.filter(l=>l.startsWith('KO')).length+' KO')

// D : litige sur la mission A (terminée, facturée, virement annoncé), dans les 24 h
const TA=process.env.TA, TB=process.env.TB // missions terminées par parcours.mjs (SCEN=A puis SCEN=B), dans les 24 h
const uidC=(await cl.auth.getUser()).data.user.id
const tp=async(c,t)=>(await c.from('transfer_payments').select('reference,status,suspended_at,amount_cents,payee').eq('transaction_id',t)).data
log('D0 virements avant litige',await tp(cl,TA),true)
let d=await cl.from('disputes').insert({transaction_id:TA,opener_id:uidC,reason:'QA scénario D : arrangement à l\'amiable',category:'qualite',claimed_cents:2000}).select().single()
log('D1 litige ouvert par le client',d.error?.message||d.data?.id,!d.error)
const DA=d.data?.id
if(DA){
  await sleep(1500)
  log('D2 virement de la prestation suspendu (paiement bloqué)',await tp(cl,TA),true)
  let {data:dm}=await cl.from('dispute_messages').select('body,kind').eq('dispute_id',DA); log('D3 message « paiement bloqué » dans le fil du litige',dm?.map(z=>z.body?.slice(0,90)),(dm||[]).some(z=>/bloqu/i.test(z.body||'')))
  let p=await cl.rpc('propose_settlement',{p_dispute:DA,p_amount_cents:2000}); log('D4 le client propose 20 € (arrangement)',p.error?.message||p.data,!p.error)
  let a=await pro.rpc('accept_settlement',{p_dispute:DA}); log('D5 le prestataire accepte',a.error?.message||a.data,!a.error)
  await sleep(1500)
  let dd=await cl.from('disputes').select('status,settlement_status,agreed_cents,closed_at').eq('id',DA).single(); log('D6 litige clos par accord',dd.data,dd.data?.status==='resolved')
  log('D7 virements après accord (reprise + avoir)',await tp(cl,TA),true)
  let inv=await cl.from('invoices').select('number,kind,net_cents,credit_cents,credit_number').eq('transaction_id',TA); log('D8 avoir de 20 € posé sur la facture de la prestation',inv.error?.message||inv.data,(inv.data||[]).some(z=>z.credit_cents===2000))
}
// E : litige sur la mission B -> intervention de PING demandée
let e=await pro.from('disputes').insert({transaction_id:TB,opener_id:(await pro.auth.getUser()).data.user.id,reason:'QA scénario E : intervention de PING',category:'autre'}).select().single()
log('E1 litige ouvert par le prestataire',e.error?.message||e.data?.id,!e.error)
const DB=e.data?.id
if(DB){
  let m1=await cl.rpc('request_ping_mediation',{p_dispute:DB}); log('E2 le client demande l\'intervention de PING',m1.error?.message||m1.data,!m1.error)
  let m2=await pro.rpc('request_ping_mediation',{p_dispute:DB}); log('E3 redemandée par l\'autre partie : sans effet de plus',m2.error?.message||m2.data,!m2.error)
  let x=await cl.rpc('ping_decide_dispute',{p_dispute:DB,p_refund_cents:1000,p_reason:'QA'}); log('E4 un client ne peut PAS décider à la place de PING',x.error?.message,!!x.error)
  let dd=await cl.from('disputes').select('status,mediation_requested_at').eq('id',DB).single(); log('E5 intervention de PING marquée sur le litige',dd.data||dd.error?.message,!dd.error&&!!dd.data?.mediation_requested_at)
  console.log('DISPUTE_B',DB)
}
console.log(out.filter(l=>l.startsWith('KO')).length+' KO')
