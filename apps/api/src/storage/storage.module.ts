import { Global, Module } from '@nestjs/common';

import { OrphanFilesSweeper } from './orphan-files.sweeper';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, OrphanFilesSweeper],
  exports: [StorageService],
})
export class StorageModule {}
