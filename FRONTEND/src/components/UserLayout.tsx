import { Outlet } from 'react-router-dom';
import UserShell from './UserShell';

/**
 * React Router's <Outlet> renders the matched child route here
 * without unmounting this component.
 */
export default function UserLayout() {
  return (
    <UserShell>
      <Outlet />
    </UserShell>
  );
}
