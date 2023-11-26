/**
 * Entry point.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

import VirtualTable from '../../src/VirtualTable';
import { Result } from '../../src/helpers/types';

const fetchData = (index: number, count: number): Promise<Result<number>> => {
    const items = [...Array(count).keys()].map((value) => value + index);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve({
                from: index,
                items,
                totalCount: 1234,
            });
        }, 1000);
    });
};

function App() {
    return (
        <VirtualTable<number>
            renderer={(i) => <div
                style={{ padding: 5 }}
                onClick={(e) => {
                    console.log(`${i} clicked`);
                }}
            >
                {i !== undefined ? i : 'unknown'}
            </div>}
            height={400}
            fetcher={fetchData}
        />
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
