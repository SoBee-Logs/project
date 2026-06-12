import React, { useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { CardSkeleton, ErrorBox } from './common/StatusViews'
import DrillDownModal from './common/DrillDownModal'

const LIFE_STAGE = {
  UNI: '대학생', CHILD_BABY: '영유아 자녀', NEW_WED: '신혼부부',
  SINGLE: '1인 가구', SENIOR: '시니어',
}

const TABS = ['소비', '일기', '사진', '카드']

function UserDetailModal({ userId, onClose }) {
  const { data, error, loading } = useFetch(`/admin/user-detail/${userId}`)
  const [tab, setTab] = useState('소비')

  const genderLabel = g => g?.toLowerCase() === 'm' ? '남' : g?.toLowerCase() === 'f' ? '여' : '-'

  return (
    <DrillDownModal title={data ? `${data.name} 상세` : '유저 상세'} onClose={onClose} width={640}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>오류: {error}</p>}
      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{data.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                {data.age}세 · {genderLabel(data.gender)} · {LIFE_STAGE[data.life_stage_code] || '미분류'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: '4px 12px', borderRadius: 14, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13, background: tab === t ? '#6c63ff' : '#fff', color: tab === t ? '#fff' : '#666' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {tab === '소비' && (
            <>
              <div style={ms.sectionTitle}>상위 소비 카테고리</div>
              {data.top_categories.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>데이터 없음</p>}
              {data.top_categories.map((c, i) => {
                const max = data.top_categories[0]?.total || 1
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{c.category}</span>
                      <span style={{ fontWeight: 700, color: '#6c63ff' }}>{c.total.toLocaleString()}원 ({c.count}건)</span>
                    </div>
                    <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6 }}>
                      <div style={{ height: '100%', width: `${(c.total / max) * 100}%`, background: '#6c63ff', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ ...ms.sectionTitle, marginTop: 20 }}>최근 거래 10건</div>
              {data.recent_transactions.map((t, i) => (
                <div key={i} style={ms.txRow}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.place}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{t.date} · {t.category}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#333' }}>{t.amount.toLocaleString()}원</div>
                </div>
              ))}
            </>
          )}

          {tab === '일기' && (
            <>
              <div style={ms.sectionTitle}>최근 일기 ({data.recent_diaries.length}건)</div>
              {data.recent_diaries.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>일기 없음</p>}
              {data.recent_diaries.map(d => (
                <div key={d.id} style={ms.diary}>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>{d.created_at.slice(0, 10)}</div>
                  <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{d.content}</div>
                </div>
              ))}
            </>
          )}

          {tab === '사진' && (
            <>
              <div style={ms.sectionTitle}>최근 사진 VLM 결과 ({data.recent_photos.length}장)</div>
              {data.recent_photos.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>사진 없음</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {data.recent_photos.map(p => (
                  <div key={p.photo_id} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                    {p.url ? (
                      <img src={p.url} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <div style={{ height: 80, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                    )}
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff' }}>{p.category || '미분류'}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>{p.item || '-'}</div>
                      {p.confidence && (
                        <div style={{ fontSize: 10, color: p.confidence === 'high' ? '#10b981' : p.confidence === 'medium' ? '#f59e0b' : '#ef4444' }}>
                          {p.confidence === 'high' ? '높음' : p.confidence === 'medium' ? '중간' : '낮음'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === '카드' && (
            <>
              <div style={ms.sectionTitle}>보유 카드 ({data.cards.length}개)</div>
              {data.cards.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>카드 없음</p>}
              {data.cards.map(c => (
                <div key={c.card_id} style={ms.cardRow}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name || '카드명 없음'}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{c.type}</div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </DrillDownModal>
  )
}

function downloadCsv(data) {
  const headers = ['이름', '나이', '성별', '생애주기', '카드', '계좌', '거래 내역', '사진', '일기', '마지막 일기']
  const rows = data.map(u => [
    u.name, u.age ?? '', u.gender === 'M' ? '남' : u.gender === 'F' ? '여' : '',
    LIFE_STAGE[u.life_stage_code] || u.life_stage_code || '',
    u.card_count, u.bank_count, u.tx_count,
    u.photo_count, u.diary_count, u.last_diary || '',
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'users.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function UserDataStats() {
  const { data, error, loading, reload } = useFetch('/admin/user-data')
  const [filter, setFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)

  if (error) return <ErrorBox message={error} onRetry={reload} />

  const filtered = (() => {
    if (!data) return []
    if (filter === 'inactive') return data.filter(u => !u.last_diary)
    if (filter === 'no_photo') return data.filter(u => u.photo_count === 0)
    return data
  })()

  const bubbleData = filtered.map(u => ({
    x: Number(u.diary_count) || 0,
    y: Number(u.photo_count) || 0,
    z: Number(u.tx_count) || 1,
    name: u.name,
  }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={styles.heading}>사용자별 데이터 현황</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all', '전체'], ['inactive', '일기 없음'], ['no_photo', '사진 없음']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ ...styles.filterBtn, ...(filter === v ? styles.filterActive : {}) }}>{l}</button>
          ))}
          {data && (
            <button onClick={() => downloadCsv(data)} style={styles.csvBtn}>⬇ CSV</button>
          )}
        </div>
      </div>

      <div style={styles.chartBox}>
        <h3 style={styles.subheading}>일기 vs 사진 (버블 크기 = 거래 내역)</h3>
        {loading ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>로딩 중...</div>
        ) : bubbleData.length === 0 ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="x" name="일기" type="number" tick={{ fontSize: 11 }} label={{ value: '일기', position: 'insideBottom', offset: -8, fontSize: 12, fill: '#888' }} />
              <YAxis dataKey="y" name="사진" type="number" tick={{ fontSize: 11 }} label={{ value: '사진', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#888' }} />
              <ZAxis dataKey="z" name="거래내역" type="number" range={[40, 600]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.name}</div>
                    <div>일기: {d.x}</div>
                    <div>사진: {d.y}</div>
                    <div>거래내역: {d.z === 1 ? 0 : d.z}</div>
                  </div>
                )
              }} />
              <Scatter data={bubbleData} fill="#6c63ff" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={styles.tableWrap}>
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(5)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th>유저</th><th>나이</th><th>성별</th><th>생애주기</th>
                <th>카드</th><th>계좌</th><th>거래 내역</th>
                <th>사진</th><th>일기</th><th>마지막 일기</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.user_id} style={styles.tr}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.age ?? '-'}</td>
                  <td>{u.gender?.toLowerCase() === 'm' ? '남' : u.gender?.toLowerCase() === 'f' ? '여' : '-'}</td>
                  <td><span style={styles.badge}>{LIFE_STAGE[u.life_stage_code] || u.life_stage_code || '미분류'}</span></td>
                  <td style={styles.num}>{Number(u.card_count) || 0}</td>
                  <td style={styles.num}>{Number(u.bank_count) || 0}</td>
                  <td style={styles.num}>{(Number(u.tx_count) || 0).toLocaleString()}</td>
                  <td style={styles.num}>{Number(u.photo_count) || 0}</td>
                  <td style={styles.num}>{Number(u.diary_count) || 0}</td>
                  <td style={{ fontSize: 12, color: u.last_diary ? '#666' : '#ef4444' }}>
                    {u.last_diary ? u.last_diary.slice(0, 10) : '없음'}
                  </td>
                  <td>
                    <button onClick={() => setSelectedUser(u.user_id)} style={styles.detailBtn}>상세</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedUser && (
        <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, margin: 0 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#444' },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  tableWrap: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead: { background: '#f8f9fa' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 16 },
  badge: { background: '#ede9fe', color: '#6c63ff', padding: '2px 8px', borderRadius: 8, fontSize: 12 },
  filterBtn: {
    padding: '5px 14px', borderRadius: 16, border: '1px solid #ddd',
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666',
  },
  filterActive: { background: '#6c63ff', color: '#fff', border: '1px solid #6c63ff' },
  csvBtn: {
    padding: '5px 14px', borderRadius: 16, border: '1px solid #10b981',
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#10b981',
  },
  detailBtn: {
    padding: '3px 10px', borderRadius: 6, border: '1px solid #6c63ff',
    background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6c63ff',
  },
}

const ms = {
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6c63ff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  diary: { background: '#f8f9fa', borderRadius: 8, padding: '12px 14px', marginBottom: 8 },
  txRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #f5f5f5',
  },
  cardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px', background: '#f8f9fa', borderRadius: 10, marginBottom: 8,
  },
}

if (typeof document !== 'undefined' && !document.getElementById('table-style')) {
  const s = document.createElement('style')
  s.id = 'table-style'
  s.textContent = 'table th, table td { padding: 10px 14px; text-align: left; }'
  document.head.appendChild(s)
}
