import { Routes, Route } from 'react-router-dom';
import { AuthenticateWithRedirectCallback} from '@clerk/clerk-react';
import AuthCallbackPage from './pages/auth-callback/AuthCallbackPage';
import HomePage from './pages/home/homePage';
import RoomPage from './pages/room/RoomPage';
import AddFriendsPage from './pages/friends/AddFriendsPage';
import FriendRequestsPage from './pages/friends/FriendRequestsPage';
import ProtectedRoute from './ProtectedRoute'

function App() {
  return (
    <>
      <Routes>
        <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signInForceRedirectUrl="/auth-callback" />} />
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<HomePage />} />
        

        <Route element={<ProtectedRoute />}>
        <Route path="/room/:roomCode" element={<RoomPage />} />
          <Route path="/friends/add" element={<AddFriendsPage />} />
          <Route path="/friends/requests" element={<FriendRequestsPage />} />
        </Route>
      </Routes>
   </>
  )
}

export default App