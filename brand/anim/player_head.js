(function(){var q=location.search,c=document.documentElement.classList;
if(/[?&]admin=1\b/.test(q))c.add('admin');
if(/[?&]embed=1\b/.test(q))c.add('embed');
if(location.hash==='#record')c.add('rec');})();
