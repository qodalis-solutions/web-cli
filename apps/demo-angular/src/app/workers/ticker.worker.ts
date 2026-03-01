/**
 * Example background service running in a Web Worker.
 * Demonstrates the worker message protocol without importing from @qodalis/cli-core.
 *
 * Protocol:
 *   Inbound:  { type: 'start' } | { type: 'stop' } | { type: 'abort' }
 *   Outbound: { type: 'log', level, message } | { type: 'event', event } | { type: 'status', status }
 */

let intervalId: ReturnType<typeof setInterval> | null = null;
let count = 0;

addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data;

    switch (msg.type) {
        case 'start':
            count = 0;
            postMessage({ type: 'status', status: 'running' });
            postMessage({ type: 'log', level: 'info', message: 'Ticker worker started' });

            intervalId = setInterval(() => {
                count++;
                postMessage({
                    type: 'log',
                    level: 'info',
                    message: `Tick #${count} from worker thread`,
                });
                postMessage({
                    type: 'event',
                    event: {
                        source: 'ticker',
                        type: 'tick',
                        data: { count },
                    },
                });
            }, 5000);
            break;

        case 'stop':
        case 'abort':
            if (intervalId !== null) {
                clearInterval(intervalId);
                intervalId = null;
            }
            postMessage({ type: 'log', level: 'info', message: `Ticker worker stopped after ${count} ticks` });
            postMessage({ type: 'status', status: 'stopped' });
            break;
    }
});
