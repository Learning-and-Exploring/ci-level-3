"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
exports.app.use(express_1.default.json());
// Routes
exports.app.get('/', (_req, res) => {
    res.send('Postgres with TypeScript');
});
exports.app.get('/health', (_req, res) => {
    res.json({ status: 'OK' });
});
// Error handler
exports.app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Internal Server Error" });
});
// Start server
if (require.main === module) {
    exports.app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}
