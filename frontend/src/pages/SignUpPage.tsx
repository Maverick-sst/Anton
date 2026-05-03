import { SignUp } from "@clerk/clerk-react"

export default function SignUpPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/chat" />
    </div>
  )
}
