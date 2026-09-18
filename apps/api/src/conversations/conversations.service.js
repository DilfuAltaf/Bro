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
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ConversationsService = class ConversationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(userId) {
        if (userId) {
            return this.prisma.conversationThread.findMany({ where: { userId } });
        }
        return this.prisma.conversationThread.findMany();
    }
    async findById(id) {
        const thread = await this.prisma.conversationThread.findUnique({
            where: { id },
            include: {
                messages: true,
            }
        });
        if (!thread)
            throw new common_1.NotFoundException('Conversation thread not found');
        return thread;
    }
    create(data) {
        return this.prisma.conversationThread.create({ data });
    }
    update(id, data) {
        return this.prisma.conversationThread.update({
            where: { id },
            data,
        });
    }
    delete(id) {
        return this.prisma.conversationThread.delete({
            where: { id },
        });
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConversationsService);
//# sourceMappingURL=conversations.service.js.map