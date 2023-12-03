/**
 * Entry point.
 *
 * @author Nikita Vakula <programmistov.programmist@gmail.com>
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

import VirtualTable from '../../src/VirtualTable';
import { Result, Style } from '../../src/helpers/types';
import css from './index.css';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

const style = css as Style;
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
        <Container>
            <Row style={{
                height: '50px'
            }}/>
            <Row>
                <Col/>
                <Col>
                    <VirtualTable<number>
                        style={style}
                        renderer={(i) => <div
                            className='text-center'
                            style={{
                                padding: 5,
                            }}
                            onClick={(e) => {
                                console.log(`${i} clicked`);
                            }}
                        >
                            {i !== undefined ? i : 'unknown'}
                        </div>}
                        height={400}
                        fetcher={fetchData}
                    />
                </Col>
                <Col/>
            </Row>
            <Row style={{
                height: '50px'
            }}/>
        </Container>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
