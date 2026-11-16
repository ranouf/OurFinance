export default {
  fetch(): Response {
    return new Response(JSON.stringify({ error: 'Service non configuré' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};
