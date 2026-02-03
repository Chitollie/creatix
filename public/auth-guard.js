// Simple client-side auth guard: redirects to /login when no token found
(function(){
  try{
    const path = location.pathname;
    const publicPaths = ['/login','/login.html','/register','/payment/webhook','/payment/create-checkout','/favicon.ico'];
    if (publicPaths.includes(path)) return;
    // allow static assets
    if (path.startsWith('/uploads') || path.startsWith('/css') || path.startsWith('/js') || path.startsWith('/images') || path.startsWith('/public')) return;
    const token = localStorage.getItem('token');
    if (!token) {
      location.replace('/login.html');
    }
  }catch(e){ console.warn('auth-guard error', e); }
})();
