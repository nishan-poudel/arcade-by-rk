import { SELF } from 'cloudflare:test'

export interface TestSocket {
  send(type: string, payload?: unknown): void
  next(): Promise<{ type: string; payload: unknown }>
  /** Discards whatever is currently queued — used to drop broadcasts that
   * are a side effect of another player's action (e.g. someone else joining
   * the lobby) and aren't what the current test step is waiting for. */
  drain(): void
  close(): void
}

type PendingMessage = { type: string; payload: unknown }

export async function connect(room: string, mode: 'game' | 'score' = 'game'): Promise<TestSocket> {
  const res = await SELF.fetch(`http://example.com/ws?room=${room}&mode=${mode}`, {
    headers: { Upgrade: 'websocket' },
  })
  const ws = res.webSocket
  if (!ws) throw new Error('Expected a WebSocket in the response')
  ws.accept()

  const queue: PendingMessage[] = []
  const waiters: ((msg: PendingMessage) => void)[] = []

  ws.addEventListener('message', (ev: MessageEvent) => {
    const msg = JSON.parse(ev.data as string) as PendingMessage
    const waiter = waiters.shift()
    if (waiter) waiter(msg)
    else queue.push(msg)
  })

  return {
    send(type, payload) {
      ws.send(JSON.stringify({ type, payload }))
    },
    next() {
      const queued = queue.shift()
      if (queued) return Promise.resolve(queued)
      return new Promise((resolve) => waiters.push(resolve))
    },
    drain() {
      queue.length = 0
    },
    close() {
      ws.close()
    },
  }
}

/** Every mutating message broadcasts a fresh `state` to all 4 connections —
 * use this (not a single socket's `.next()`) whenever the action being
 * awaited is expected to succeed, so no one's queue accumulates an unread
 * broadcast that a later, unrelated `.next()` would wrongly pick up. Only
 * skip this (and call `.next()` on just the actor) when the action is
 * expected to fail — an error reply goes only to the socket that sent it. */
export function collectAll(sockets: TestSocket[]): Promise<{ type: string; payload: unknown }[]> {
  return Promise.all(sockets.map((s) => s.next()))
}

/** Lets any already-dispatched WebSocket message events flush before the
 * next assertion — a join's broadcastState() fan-out to other sockets can
 * land a task tick after the joining socket's own message resolves. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function createRoom(mode: 'game' | 'score' = 'game'): Promise<string> {
  const res = await SELF.fetch('http://example.com/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  const data = await res.json<{ roomCode: string }>()
  return data.roomCode
}

/** Connects 4 sockets in seat order and joins them all (socket[0] becomes host). */
export async function joinFour(
  room: string,
  mode: 'game' | 'score' = 'game',
  names = ['Alice', 'Bina', 'Chirag', 'Deepa'],
): Promise<{ sockets: TestSocket[]; playerIds: string[] }> {
  const sockets: TestSocket[] = []
  const playerIds: string[] = []
  for (const name of names) {
    const socket = await connect(room, mode)
    socket.send('join', { name })
    const state = await socket.next()
    const payload = state.payload as { yourPlayerId: string }
    sockets.push(socket)
    playerIds.push(payload.yourPlayerId)

    // Every already-connected socket also gets a fresh broadcast now that
    // someone new joined the lobby — drain those so later `.next()` calls
    // in a test only ever see messages caused by that test's own actions.
    await tick()
    for (const existing of sockets) existing.drain()
  }
  return { sockets, playerIds }
}
