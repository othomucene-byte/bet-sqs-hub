import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'

import { EmailShell, button, link, text } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailShell
    preview={`Foi convidado para a ${siteName}`}
    heading="Recebeu um convite"
  >
    <Text style={text}>
      Foi convidado para se juntar à{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      .
    </Text>
    <Text style={text}>
      Aceite o convite abaixo para criar a sua conta e começar a usar a
      plataforma.
    </Text>
    <Button className="dm-btn" style={button} href={confirmationUrl}>
      Aceitar convite
    </Button>
    <Text style={text}>
      Se não esperava este convite, pode ignorar esta mensagem.
    </Text>
  </EmailShell>
)

export default InviteEmail
