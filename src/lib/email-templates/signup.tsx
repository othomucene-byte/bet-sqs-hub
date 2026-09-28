import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'

import { EmailShell, button, link, text } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailShell
    preview={`Confirme o seu e-mail na ${siteName}`}
    heading="Confirme o seu e-mail"
  >
    <Text style={text}>
      Bem-vindo à{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      ! A sua conta está quase pronta.
    </Text>
    <Text style={text}>
      Confirme o endereço <strong>{recipient}</strong> clicando no botão abaixo
      para ativar o acesso à plataforma.
    </Text>
    <Button className="dm-btn" style={button} href={confirmationUrl}>
      Confirmar e-mail
    </Button>
    <Text style={text}>
      Se não criou esta conta, pode ignorar esta mensagem com segurança.
    </Text>
  </EmailShell>
)

export default SignupEmail
