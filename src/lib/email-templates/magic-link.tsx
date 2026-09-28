import * as React from 'react'

import { Button, Text } from '@react-email/components'

import { EmailShell, button, text } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <EmailShell
    preview={`O seu link de entrada na ${siteName}`}
    heading="Entrar na sua conta"
  >
    <Text style={text}>
      Clique no botão abaixo para entrar na {siteName} sem precisar de
      palavra-passe.
    </Text>
    <Button className="dm-btn" style={button} href={confirmationUrl}>
      Entrar agora
    </Button>
    <Text style={text}>
      Este link é pessoal e expira em pouco tempo. Se não pediu para entrar,
      ignore esta mensagem.
    </Text>
  </EmailShell>
)

export default MagicLinkEmail
