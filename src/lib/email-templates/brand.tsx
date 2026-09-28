import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import logoAsset from '@/assets/betfcom-email-logo.jpg.asset.json'

export const SITE_NAME = 'Betfcom SQs'
export const SITE_URL = 'https://betfcom.com'
export const LOGO_URL = `${SITE_URL}${logoAsset.url}`

// Cores da marca
const navy = '#0B1220'
const navySoft = '#111C2E'
const emerald = '#10B981'
const emeraldSoft = '#6EE7B7'
const bodyText = '#C3CEDD'
const muted = '#8494A8'

export const main = {
  backgroundColor: '#050A12',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: '0',
  padding: '24px 0',
}

export const container = {
  backgroundColor: navy,
  border: `1px solid ${navySoft}`,
  borderRadius: '16px',
  maxWidth: '600px',
  margin: '0 auto',
  padding: '32px 28px',
}

export const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#FFFFFF',
  margin: '0 0 16px',
}

export const text = {
  fontSize: '15px',
  color: bodyText,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const link = { color: emeraldSoft, textDecoration: 'underline' }

export const button = {
  backgroundColor: emerald,
  color: '#04150E',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  border: `1px solid ${emerald}`,
  borderRadius: '10px',
  padding: '14px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const codeBox = {
  backgroundColor: navySoft,
  border: `1px solid ${emerald}`,
  borderRadius: '12px',
  color: emeraldSoft,
  fontSize: '30px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  padding: '18px 0',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}

export const footer = {
  fontSize: '12px',
  color: muted,
  lineHeight: '1.6',
  margin: '28px 0 0',
}

const logo = { borderRadius: '12px', display: 'block' }
const header = { margin: '0 0 24px' }
const divider = {
  borderTop: `1px solid ${navySoft}`,
  margin: '28px 0 0',
}

// Renderizado como texto: manter este CSS livre de >, & e aspas.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #10B981 !important; color: #04150E !important; }
  }
  [data-ogsc] .dm-btn { background-color: #10B981 !important; color: #04150E !important; }
  [data-ogsb] .dm-btn { background-color: #10B981 !important; color: #04150E !important; }
`

interface ShellProps {
  preview: string
  heading: string
  children: React.ReactNode
}

export const EmailShell = ({ preview, heading, children }: ShellProps) => (
  <Html lang="pt" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img
            src={LOGO_URL}
            width="64"
            height="64"
            alt={SITE_NAME}
            style={logo}
          />
        </Section>
        <Heading style={h1}>{heading}</Heading>
        {children}
        <Section style={divider} />
        <Text style={footer}>
          Este e-mail foi enviado automaticamente pela{' '}
          <Link href={SITE_URL} style={link}>
            {SITE_NAME}
          </Link>
          . Jogue e invista com responsabilidade — todo investimento e aposta
          envolve risco.
        </Text>
      </Container>
    </Body>
  </Html>
)
