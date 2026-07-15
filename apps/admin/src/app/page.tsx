import { redirect } from 'next/navigation';

/**
 * Site é só o painel admin — "/" não tem conteúdo próprio. Manda
 * direto pra /entrar (não pra /admin) pra não passar pela checagem de
 * sessão de app/admin/layout.tsx primeiro — quem cai aqui sem estar
 * logado veria uma tela de "Confirmando sua sessão..." só pra ser
 * jogado de volta pro login um instante depois. /entrar já faz a
 * própria checagem (login com Google ou senha, só isAdmin passa).
 */
export default function Home() {
  redirect('/entrar');
}
