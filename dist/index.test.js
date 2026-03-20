"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("./index");
(0, node_test_1.default)('GET /health returns OK status', async () => {
    const server = index_1.app.listen(0);
    try {
        const address = server.address();
        strict_1.default.ok(address && typeof address === 'object');
        const response = await fetch(`http://127.0.0.1:${address.port}/health`);
        const body = await response.json();
        strict_1.default.equal(response.status, 200);
        strict_1.default.deepEqual(body, { status: 'OK' });
    }
    finally {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
});
