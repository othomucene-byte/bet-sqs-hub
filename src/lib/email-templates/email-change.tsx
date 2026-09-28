import * as React from 'react'

import { Button, Text } from '@react-email/components'

import { EmailShell, button, text } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailShell
    preview={`Confirme o novo e-mail da sua conta ${siteName}`}
    heading="Confirmar novo e-mail"
  >
    <Text style={text}>
      Pediu para alterar o e-mail da sua conta na {siteName} de{' '}
      <strong>{oldEmail}</strong> para <strong>{newEmail}</strong>.
    </Text>
    <Button className="dm-btn" style={button} href={confirmationUrl}>
      Confirmar alteração
    </Button>
    <Text style={text}>
      Se não pediu esta alteração, ignore esta mensagem e o e-mail anterior
      permanece ativo.
    </Text>
  </EmailShell>
)

export default EmailChangeEmail
