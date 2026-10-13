import { createBrowserRouter } from 'react-router-dom'
import HomePage from './HomePage'
import DevRealtimePage from './DevRealtimePage'
import CustomerPlaceholder from './sites/customer/Placeholder'
import StaffPlaceholder from './sites/staff/Placeholder'
import ManagePlaceholder from './sites/manage/Placeholder'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/dev/realtime', element: <DevRealtimePage /> },
  { path: '/t/:qrToken/*', element: <CustomerPlaceholder /> },
  { path: '/staff/*', element: <StaffPlaceholder /> },
  { path: '/manage/*', element: <ManagePlaceholder /> },
])
