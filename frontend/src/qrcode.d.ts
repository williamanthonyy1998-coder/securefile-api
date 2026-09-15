declare module "qrcode" {
  type QRCodeOptions = Record<string, unknown>;

  const QRCode: {
    toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  };

  export default QRCode;
}
