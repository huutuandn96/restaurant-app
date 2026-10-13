import { createBrowserRouter } from 'react-router-dom'
import HomePage from './HomePage'
import DevRealtimePage from './DevRealtimePage'
import CustomerApp from './sites/customer/CustomerApp'
import StaffApp from './sites/staff/StaffApp'
import ManagePlaceholder from './sites/manage/Placeholder'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/dev/realtime', element: <DevRealtimePage /> },
  { path: '/t/:qrToken/*', element: <CustomerApp /> },
  { path: '/staff/*', element: <StaffApp /> },
  { path: '/manage/*', element: <ManagePlaceholder /> },
])
