import * as React from 'react'

import { Text } from '@react-email/components'

import { EmailShell, codeBox, text } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <EmailShell
    preview="O seu código de verificação"
    heading="Código de verificação"
  >
    <Text style={text}>
      Use o código abaixo para confirmar a sua identidade:
    </Text>
    <Text style={codeBox}>{token}</Text>
    <Text style={text}>
      O código expira em poucos minutos. Nunca partilhe este código com
      ninguém.
    </Text>
  </EmailShell>
)

export default ReauthenticationEmail
