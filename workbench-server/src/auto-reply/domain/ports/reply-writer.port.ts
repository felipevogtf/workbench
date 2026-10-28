/** Quien redacta: recibe el prompt armado y devuelve lo que contestó el agente, tal cual. */
export interface ReplyWriterPort {
  write(prompt: string): Promise<string>;
}

export const REPLY_WRITER_PORT = Symbol('REPLY_WRITER_PORT');
