import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import BottomNav from './common/components/BottomNav'
import AppBar from './common/components/AppBar'
import Home from './features/home/HomePage'
import HomeDetail from './features/diary/HomeDetail'
import Report from './features/report/Report'
import ReportDetail from './features/report/ReportDetail'
import Feed from './features/feed/Feed'
import CameraPage from './features/camera/CameraPage'
import ConsumptionLog from './features/diary/ConsumptionLog'
import LoadingPage from './features/diary/LoadingPage'
import DiaryResult from './features/diary/DiaryResult'
import Login from './features/auth/Login'
import Register from './features/auth/Register'
import MyDataConnect from './features/auth/MyDataConnect'
import ProductSearch from './features/search/ProductSearch'
import ProductDetail from './features/search/ProductDetail'

const routeConfig = [
  { path: '/',               element: <Login />,        bottomNav: false, floatingNav: false, appBar: false },
  { path: '/login',          element: <Login />,        bottomNav: false, floatingNav: false, appBar: false },
  { path: '/home',           element: <Home />,         bottomNav: true,  floatingNav: true,  appBar: false },
  { path: '/home/detail',    element: <HomeDetail />,   bottomNav: false, floatingNav: false, appBar: true, title: '홈 상세' },
  { path: '/report',         element: <Report />,       bottomNav: true,  floatingNav: false, appBar: true, title: '리포트' },
  { path: '/report/detail',  element: <ReportDetail />, bottomNav: false, floatingNav: false, appBar: true, title: '리포트 상세' },
  { path: '/feed',           element: <Feed />,         bottomNav: true,  floatingNav: false, appBar: false },
  { path: '/camera',         element: <CameraPage />,   bottomNav: false, floatingNav: false, appBar: false },
  { path: '/consumption-log',element: <ConsumptionLog />,bottomNav: false,floatingNav: false, appBar: false },
  { path: '/loading',        element: <LoadingPage />,  bottomNav: false, floatingNav: false, appBar: false },
  { path: '/diary-result',   element: <DiaryResult />,  bottomNav: false, floatingNav: false, appBar: false },
  { path: '/register',       element: <Register />,     bottomNav: false, floatingNav: false, appBar: false },
  { path: '/mydata',         element: <MyDataConnect />,bottomNav: false, floatingNav: false, appBar: false },
  { path: '/search',         element: <ProductSearch />,bottomNav: true,  floatingNav: false, appBar: false },
  { path: '/product/detail', element: <ProductDetail />,bottomNav: false, floatingNav: false, appBar: false },
]

function Layout() {
  const location = useLocation()
  const config = routeConfig.find((r) => r.path === location.pathname) ?? {
    bottomNav: false,
    floatingNav: false,
    appBar: false,
  }

  return (
    <div className="flex flex-col w-[375px] h-[100dvh] mx-auto bg-white overflow-hidden shadow-xl relative">
      {config.appBar && <AppBar title={config.title} />}
      <div className={`flex-1 overflow-y-auto ${config.floatingNav ? 'pb-0' : ''}`}>
        <Routes>
          {routeConfig.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Routes>
      </div>
      {config.bottomNav && (
        <div className={config.floatingNav ? 'absolute bottom-0 left-0 right-0 z-30' : ''}>
          <BottomNav floating={config.floatingNav} />
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
