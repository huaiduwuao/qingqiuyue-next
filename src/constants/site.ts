// 站点合规信息:备案号、声明页地址。侧栏底部(SiteLegalFooter)与 /legal 页共用。
// 备案号留空则不显示该行;构建时可用同名环境变量覆盖。

/** ICP 备案号。 */
export const ICP_NUMBER = process.env.NEXT_PUBLIC_ICP_NUMBER ?? '鲁ICP备17052731号';
/** 公安联网备案号,如「粤公网安备 44000000000000号」(可选)。 */
export const POLICE_BEIAN_NUMBER = process.env.NEXT_PUBLIC_POLICE_BEIAN_NUMBER ?? '';

export const ICP_QUERY_URL = 'https://beian.miit.gov.cn/';
/** 公安备案查询页,带上备案号里的数字串。 */
export function policeBeianUrl(no: string): string {
  const code = no.replace(/\D/g, '');
  return code ? `https://beian.mps.gov.cn/#/query/webSearch?code=${code}` : 'https://beian.mps.gov.cn/';
}

export const SITE_NAME = '清秋月';
export const LEGAL_PATH = '/legal';
/** /legal 页内各节的锚点,侧栏底部的链接直接跳到对应小节。 */
export const LEGAL_SECTIONS = {
  about: 'about',
  disclaimer: 'disclaimer',
  dataCollection: 'data-collection',
  aigc: 'aigc',
  trade: 'trade',
  complaint: 'complaint',
} as const;
