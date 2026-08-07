/**
 * Entry point.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { VirtualTable } from '@krjakbrjak/virtualtable';
import type { Result, Style, DataSource } from '@krjakbrjak/virtualtable';

import rowStyle from './index.module.css';
import s from './app.module.css';
import './styles.css';

const TOTAL = 1234;

interface File {
    id: number;
    name: string;
    size: string;
    date: string;
}

const TYPE = ['txt', 'csv', 'log', 'json', 'png'];

// Derived from the index so a row looks the same every time it scrolls back.
const file = (index: number): File => {
    const day = new Date(Date.UTC(2026, 0, 1 + index));
    return {
        id: index,
        name: `file-${String(index).padStart(5, '0')}.${TYPE[index % TYPE.length]}`,
        size: `${8 + ((index * 37) % 992)} KB`,
        date: day.toISOString().slice(0, 10),
    };
};

// Stands in for a paginated API, latency included.
class Files implements DataSource<File> {
    // Flipped by the toggle in the header, so the error handling has something
    // to react to.
    down = false;

    fetch(index: number, count: number): Promise<Result<File>> {
        if (this.down) {
            return Promise.reject(new Error(`page starting at ${index} is unavailable`));
        }
        const items = [...Array(count).keys()].map((offset) => file(offset + index));
        return new Promise((resolve) => {
            setTimeout(() => resolve({ from: index, items, totalCount: TOTAL }), 400);
        });
    }
}

const source = new Files();

const Loading = () => (
    <div className={s.line}>
        <div className={s['col--name']}>
            <div className={s.skeleton} style={{ width: '45%' }} />
        </div>
        <div className={s['col--size']}>
            <div className={s.skeleton} />
        </div>
        <div className={s['col--date']}>
            <div className={s.skeleton} />
        </div>
    </div>
);

const Row = ({ item }: { item: File }) => (
    <div className={s.line}>
        <div className={`${s['col--name']} ${s.name}`}>{item.name}</div>
        <div className={`${s['col--size']} ${s.muted}`}>{item.size}</div>
        <div className={`${s['col--date']} ${s.muted}`}>{item.date}</div>
    </div>
);

function App() {
    const [selected, setSelected] = useState<File | null>(null);
    const [down, setDown] = useState(false);
    const [failed, setFailed] = useState<number | null>(null);

    return (
        <main className={s.page}>
            <div className={s.card}>
                <div className={s.card__head}>
                    <h1 className={s.card__title}>Files</h1>
                    <button
                        type="button"
                        className={s.toggle}
                        aria-pressed={down}
                        onClick={() => {
                            source.down = !source.down;
                            setDown(source.down);
                            if (!source.down) {
                                setFailed(null);
                            }
                        }}
                    >
                        {down ? 'Restore source' : 'Simulate outage'}
                    </button>
                    <span className={s.card__count}>{TOTAL.toLocaleString()} files</span>
                </div>

                {failed !== null && (
                    <p className={s.notice}>Could not load page {failed}. Retrying.</p>
                )}

                <div className={s.columns}>
                    <div className={s['col--name']}>Name</div>
                    <div className={s['col--size']}>Size</div>
                    <div className={s['col--date']}>Date</div>
                </div>

                <div className={s.table}>
                    <VirtualTable<File>
                        style={rowStyle as Style}
                        renderer={(item) => (item ? <Row item={item} /> : <Loading />)}
                        fetcher={source}
                        onSelected={(_, item) => setSelected(item)}
                        onError={(page) => setFailed(page)}
                    />
                </div>

                <p className={s.readout}>
                    <span>Selected</span>
                    <b>{selected ? selected.name : 'none'}</b>
                </p>
            </div>
        </main>
    );
}

const container = document.getElementById('root');
if (!container) {
    throw new Error('Root container not found');
}

createRoot(container).render(<App />);
