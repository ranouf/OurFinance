export async function publishThenRefresh<T>(publish: () => Promise<unknown>, refresh: () => Promise<T>): Promise<{ refreshed: true; value: T } | { refreshed: false }> {
  await publish();
  try { return { refreshed: true, value: await refresh() }; }
  catch { return { refreshed: false }; }
}
