import { redirect } from 'next/navigation';

// 「红果」分类直接使用红果数据源：/duanju 统一跳转到红果短剧首页
export default function DuanjuPage() {
  redirect('/duanju/hongguo');
}
