import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
  ICliExecutionContext,
  CliLoaderProps,
  ICliTerminalWriter,
  ICliUserSession,
} from '../models';
import { CliCommandExecutorService } from './cli-command-executor.service';
import { CliTerminalWriter } from './cli-terminal-writer';

export class CliExecutionContext implements ICliExecutionContext {
  public data: Record<string, Record<string, any>> = {};

  public userSession?: ICliUserSession;

  public writer: ICliTerminalWriter;

  public loader?: CliLoaderProps = {
    show: () => {},
    hide: () => {},
  };

  public onAbort = new Subject<void>();

  constructor(
    public terminal: Terminal,
    public executor: CliCommandExecutorService,
    loader?: CliLoaderProps
  ) {
    this.writer = new CliTerminalWriter(terminal);

    if (loader) {
      this.loader = loader;
    }
  }

  /**
   * Aborts the current command
   */
  public abort(): void {
    this.onAbort.next();
  }

  public setSession(session: ICliUserSession): void {
    this.userSession = session;
  }
}
