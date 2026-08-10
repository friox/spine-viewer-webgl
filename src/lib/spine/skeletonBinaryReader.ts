export class SkeletonBinaryReader {
  private data: Uint8Array;
  private offset: number = 0;
  private textDecoder = new TextDecoder("utf-8");

  constructor(buffer: ArrayBuffer | Uint8Array) {
    this.data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  }

  public setOffset(offset: number): void {
    this.offset = offset;
  }

  public getOffset(): number {
    return this.offset;
  }

  private readByte(): number {
    if (this.offset >= this.data.length) {
      throw new Error("Unexpected end of binary data");
    }
    return this.data[this.offset++];
  }

  // https://ko.esotericsoftware.com/spine-binary-format, Varint
  public readVarint(optimizePositive: boolean): number {
    let b = this.readByte();
    let value = b & 0x7f;
    if (b & 0x80) {
      b = this.readByte();
      value |= (b & 0x7f) << 7;
      if (b & 0x80) {
        b = this.readByte();
        value |= (b & 0x7f) << 14;
        if (b & 0x80) {
          b = this.readByte();
          value |= (b & 0x7f) << 21;
          if (b & 0x80) {
            b = this.readByte();
            value |= (b & 0x7f) << 28;
          }
        }
      }
    }
    if (!optimizePositive) {
      value = (value >>> 1) ^ -(value & 1);
    }
    return value;
  }

  public readString(): string | null {
    const length = this.readVarint(true);
    if (length === 0) return null;
    if (length === 1) return "";
    const stringLength = length - 1;
    const bytes = this.data.subarray(this.offset, this.offset + stringLength);
    this.offset += stringLength;
    return this.textDecoder.decode(bytes);
  }

  public skipBytes(count: number): void {
    this.offset += count;
  }
}
