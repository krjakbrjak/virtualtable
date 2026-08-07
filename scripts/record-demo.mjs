import { mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
    .scriptName('record-demo')
    .usage(
        '$0 --frames <dir> --url <url> --chrome <path>\n\n' +
            'Drives a headless Chrome with Playwright and writes one PNG per\n' +
            'animation step into --frames, numbered for ffmpeg.\n\n' +
            'The demo must already be served at --url. Encode the frames with e.g.\n' +
            '  ffmpeg -framerate 15 -i <dir>/%04d.png demo.gif',
    )
    .option('frames', {
        type: 'string',
        demandOption: true,
        describe: 'Directory to write numbered PNG frames into',
    })
    .option('url', {
        type: 'string',
        demandOption: true,
        describe: 'URL of the running demo',
    })
    .option('chrome', {
        type: 'string',
        demandOption: true,
        default: process.env.CHROME,
        defaultDescription: '$CHROME',
        describe: 'Chrome or Chromium binary',
    })
    .check(({ chrome }) => {
        if (!existsSync(resolve(process.cwd(), chrome))) {
            throw new Error(`browser not found: ${chrome}`);
        }
        return true;
    })
    .strict()
    .help()
    .parseSync();

const FRAMES = resolve(process.cwd(), argv.frames);
const DEMO_URL = argv.url;
const CHROME = resolve(process.cwd(), argv.chrome);

const WIDTH = 780;
const HEIGHT = 660;
const SCALE = 2;
const FPS = 15;

// The pointer is not in the screenshots, so it is drawn.
const drawCursor = () => {
    const style = document.createElement('style');
    style.textContent = [
        '::-webkit-scrollbar { width: 12px }',
        '::-webkit-scrollbar-track { background: #f4f5f8 }',
        '::-webkit-scrollbar-thumb {',
        '  background: #c3c9d4; border-radius: 6px; border: 3px solid #f4f5f8 }',
    ].join('');

    const cursor = document.createElement('div');
    cursor.style.cssText = [
        'position:fixed',
        'z-index:9999',
        'width:18px',
        'height:18px',
        'margin:-9px 0 0 -9px',
        'border-radius:50%',
        'background:rgba(28,35,49,.28)',
        'border:2px solid rgba(28,35,49,.65)',
        'pointer-events:none',
    ].join(';');

    const attach = () => {
        document.head.appendChild(style);
        document.body.appendChild(cursor);
        globalThis.__cursor = (x, y) => {
            cursor.style.left = `${x}px`;
            cursor.style.top = `${y}px`;
        };
        globalThis.__press = (down) => {
            cursor.style.transform = down ? 'scale(.75)' : 'scale(1)';
        };
    };

    if (document.body) {
        attach();
    } else {
        document.addEventListener('DOMContentLoaded', attach);
    }
};

const run = async () => {
    try {
        await fetch(DEMO_URL);
    } catch {
        throw new Error(`nothing answering at ${DEMO_URL}, start the demo first`);
    }

    await mkdir(FRAMES, { recursive: true });
    for (const name of await readdir(FRAMES)) {
        if (/^\d{4}\.png$/.test(name)) {
            await rm(join(FRAMES, name));
        }
    }

    const browser = await chromium.launch({ executablePath: CHROME });
    let frame = 0;

    try {
        const page = await browser.newPage({
            viewport: { width: WIDTH, height: HEIGHT },
            deviceScaleFactor: SCALE,
        });

        await page.addInitScript(drawCursor);
        await page.goto(DEMO_URL);
        await page.waitForTimeout(900);

        // Paced, so a second of frames is a second of the demo: without it the
        // page is sampled as fast as screenshots allow and never gets long
        // enough to answer a fetch.
        const capture = async (count = 1) => {
            for (let i = 0; i < count; i += 1) {
                const name = String(frame).padStart(4, '0');
                frame += 1;
                await page.screenshot({ path: join(FRAMES, `${name}.png`) });
                await page.waitForTimeout(1000 / FPS);
            }
        };

        const centre = async (locator) => {
            const box = await locator.boundingBox();
            return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
        };

        const moveTo = async (x, y) => {
            await page.mouse.move(x, y);
            await page.evaluate(([px, py]) => globalThis.__cursor(px, py), [x, y]);
        };

        const glide = async (from, to, steps) => {
            for (let i = 1; i <= steps; i += 1) {
                const t = i / steps;
                await moveTo(
                    Math.round(from.x + (to.x - from.x) * t),
                    Math.round(from.y + (to.y - from.y) * t),
                );
                await capture();
            }
        };

        const click = async () => {
            await page.mouse.down();
            await page.evaluate(() => globalThis.__press(true));
            await capture(2);
            await page.mouse.up();
            await page.evaluate(() => globalThis.__press(false));
            await capture(2);
        };

        const rows = page.locator('table tr');

        // Settle on the table, then pick a row.
        const third = await centre(rows.nth(2));
        const start = { x: third.x - 260, y: third.y - 120 };
        await moveTo(start.x, start.y);
        await capture(8);

        await glide(start, third, 12);
        await capture(3);
        await click();
        await capture(8);

        // Flick and settle, four times: the placeholders appear while a page
        // is in flight and resolve when it lands. Scrolling without pause
        // would show nothing but placeholders.
        for (let burst = 0; burst < 4; burst += 1) {
            for (let i = 0; i < 5; i += 1) {
                await page.mouse.wheel(0, 300);
                await capture();
            }
            await capture(10);
        }

        // Land on a row far from where we started.
        const far = await centre(rows.nth(4));
        await glide(third, far, 10);
        await click();
        await capture(18);

        process.stdout.write(`${frame} frames -> ${FRAMES}\n`);
    } finally {
        await browser.close();
    }
};

await run();
