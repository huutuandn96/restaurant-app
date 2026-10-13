import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from './shared/api'

type Health = { status: string; db: boolean; redis: boolean; time: string }

function Dot({ ok }: { ok?: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
}

export default function HomePage() {
  const { data, isError } = useQuery({ queryKey: ['health'], queryFn: () => api<Health>('/health') })

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Restaurant App</h1>
      <p className="mt-1 text-sm text-stone-500">Trang dev — chọn site để vào</p>

      <div className="mt-6 grid gap-3">
        <Link to="/staff" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">Staff site →</Link>
        <Link to="/manage" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">Manage site →</Link>
        <p className="text-sm text-stone-500">User site: quét QR tại bàn (<code>/t/:qrToken</code>)</p>
      </div>

      <div className="mt-8 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-stone-200">
        <div className="font-semibold">Trạng thái hệ thống</div>
        {isError ? (
          <p className="mt-2 text-red-600">Không kết nối được API</p>
        ) : (
          <ul className="mt-2 space-y-1">
            <li className="flex items-center gap-2"><Dot ok={data?.status === 'ok'} /> API</li>
            <li className="flex items-center gap-2"><Dot ok={data?.db} /> PostgreSQL</li>
            <li className="flex items-center gap-2"><Dot ok={data?.redis} /> Redis</li>
          </ul>
        )}
      </div>
    </main>
  )
}
