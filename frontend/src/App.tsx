import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { useAuth } from '@clerk/clerk-react'
import AntonLoader from './components/AntonLoader'
import Landing from './pages/Landing'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import ChatPage from './pages/ChatPage'
import ChatDetail from './pages/ChatDetail'

export default function App() {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return <AntonLoader fullscreen size="lg" label="Loading" />
  }

  return (
    <Routes>
      <Route path="/" element={
        <>
          <SignedIn><Navigate to="/chat" replace /></SignedIn>
          <SignedOut><Landing /></SignedOut>
        </>
      } />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/chat" element={
        <>
          <SignedIn><ChatPage /></SignedIn>
          <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
        </>
      } />
      <Route path="/chat/:id" element={
        <>
          <SignedIn><ChatDetail /></SignedIn>
          <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
        </>
      } />
    </Routes>
  )
}