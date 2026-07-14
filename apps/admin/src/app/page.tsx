import { redirect } from 'next/navigation';

/**
 * Site é só o painel admin — "/" não tem conteúdo próprio, manda
 * direto pra /admin. A checagem de sessão/isAdmin é toda feita lá
 * (ver app/admin/layout.tsx): sem sessão volta pro /entrar sozinho,
 * com sessão mas sem isAdmin mostra "área restrita".
 */
export default function Home() {
  redirect('/admin');
}
