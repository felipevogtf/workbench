import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CredentialsService } from '@credentials/application/credentials.service';
import { CredentialGroup } from '@credentials/domain/entities/credential-group.entity';
import { CreateCredentialGroupDto } from '@credentials/dto/create-credential-group.dto';
import { UpdateCredentialGroupDto } from '@credentials/dto/update-credential-group.dto';
import { CreateCredentialItemDto } from '@credentials/dto/create-credential-item.dto';
import { UpdateCredentialItemDto } from '@credentials/dto/update-credential-item.dto';
import {
  CredentialGroupResponseDto,
  RevealedValueResponseDto,
} from '@credentials/dto/credential-group-response.dto';

@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Get()
  async findAll(): Promise<CredentialGroupResponseDto[]> {
    const groups = await this.credentialsService.listGroups();
    return groups.map((group) => this.toResponseDto(group));
  }

  @Post()
  async create(
    @Body() dto: CreateCredentialGroupDto,
  ): Promise<CredentialGroupResponseDto> {
    const group = await this.credentialsService.createGroup(dto);
    return this.toResponseDto(group);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCredentialGroupDto,
  ): Promise<CredentialGroupResponseDto> {
    const group = await this.credentialsService.updateGroup(id, dto);
    return this.toResponseDto(group);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.credentialsService.deleteGroup(id);
  }

  @Post(':id/items')
  async addItem(
    @Param('id') id: string,
    @Body() dto: CreateCredentialItemDto,
  ): Promise<CredentialGroupResponseDto> {
    const group = await this.credentialsService.addItem(id, dto);
    return this.toResponseDto(group);
  }

  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCredentialItemDto,
  ): Promise<CredentialGroupResponseDto> {
    const group = await this.credentialsService.updateItem(id, itemId, dto);
    return this.toResponseDto(group);
  }

  @Delete(':id/items/:itemId')
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<CredentialGroupResponseDto> {
    const group = await this.credentialsService.removeItem(id, itemId);
    return this.toResponseDto(group);
  }

  // Un valor en claro no debe quedar en cachés del navegador ni de un proxy.
  @Get(':id/items/:itemId/reveal')
  @Header('Cache-Control', 'no-store')
  async reveal(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<RevealedValueResponseDto> {
    const value = await this.credentialsService.revealItem(id, itemId);
    return { value };
  }

  private toResponseDto(group: CredentialGroup): CredentialGroupResponseDto {
    return {
      id: group.id,
      name: group.name,
      category: group.category,
      items: group.items.map((item) => ({
        id: item.id,
        key: item.key,
        sensitive: item.sensitive,
        value: item.sensitive ? null : item.value,
      })),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }
}
