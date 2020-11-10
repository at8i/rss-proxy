export class HttpUtil {

  public extractDomain(url: string) {
    const domainRegex = /:\/\/(.[^/]+)/;
    return url.match(domainRegex)[1];
  }

  public isUrl(url: string) {
    try {
      new URL(url);
      return true;

    } catch (e) {
      return false;
    }
  }
}

export default new HttpUtil();
