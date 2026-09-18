"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
let MessagesService = class MessagesService {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async getMessages(conversationId) {
        const conversation = await this.prisma.conversationThread.findUnique({
            where: { id: conversationId },
        });
        if (!conversation)
            throw new common_1.NotFoundException('Conversation not found');
        return this.prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async sendMessage(conversationId, content) {
        // Verify conversation exists
        const conversation = await this.prisma.conversationThread.findUnique({
            where: { id: conversationId },
        });
        if (!conversation)
            throw new common_1.NotFoundException('Conversation not found');
        // 1. Fetch previous history
        const pastMessages = await this.prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
            take: 10,
        });
        // 2. Save user message
        const userMessage = await this.prisma.message.create({
            data: {
                conversationId,
                role: 'user',
                content,
            },
        });
        // 3. Call Python AI Agent
        const agentUrl = this.config.get('AI_AGENT_URL', 'http://localhost:8000');
        let aiReply = 'Maaf, saya tidak dapat merespons saat ini.';
        let intent = 'general';
        try {
            const history = pastMessages.map(m => ({
                role: m.role,
                content: m.content || '',
            }));
            const response = await fetch(`${agentUrl}/agent/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    conversationId,
                    history,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                aiReply = data.response || aiReply;
                intent = data.intent || intent;
            }
        }
        catch (error) {
            console.error('AI Agent error:', error);
        }
        // 3. Save AI response
        const assistantMessage = await this.prisma.message.create({
            data: {
                conversationId,
                role: 'assistant',
                content: aiReply,
            },
        });
        // 4. Create workflow run
        await this.prisma.workflowRun.create({
            data: {
                conversationId,
                intent,
                status: 'completed',
                completedAt: new Date(),
            },
        });
        return { userMessage, assistantMessage, intent };
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], MessagesService);
//# sourceMappingURL=messages.service.js.map