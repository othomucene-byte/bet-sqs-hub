import * as React from 'react'

import { Button, Text } from '@react-email/components'

import { EmailShell, button, text } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <EmailShell
    preview={`Recupere o acesso à sua conta ${siteName}`}
    heading="Redefinir a palavra-passe"
  >
    <Text style={text}>
      Recebemos um pedido para redefinir a palavra-passe da sua conta na{' '}
      {siteName}.
    </Text>
    <Button className="dm-btn" style={button} href={confirmationUrl}>
      Criar nova palavra-passe
    </Button>
    <Text style={text}>
      Se não fez este pedido, ignore esta mensagem — a sua palavra-passe atual
      continua válida.
    </Text>
  </EmailShell>
)

export default RecoveryEmail
