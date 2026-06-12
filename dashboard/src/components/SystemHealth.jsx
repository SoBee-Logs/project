import React from 'react'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox } from './common/StatusViews'

function StatusBadge({ status }) {
  const ok = status === 'ok'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600,
      background: ok ? '#f0fdf4' : '#fff5f5',
      color: ok ? '#065f46' : '#c53030',
      border: `1px solid ${ok ? '#a7f3d0' : '#fed7d7'}`,
    }}>
      <span style={{ fontSize: 8 }}>●</span>
      {ok ? '정상' : '오류'}
    </span>
  )
}

function MetricCard({ title, children, status }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 24,
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
      borderTop: `4px solid ${status === 'ok' ? '#10b981' : '#ef4444'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
        <StatusBadge status={status} />
      </div>
      {children}
    </div>
  )
}

export default function SystemHealth() {
  const { data, error, loading, reload } = useFetch('/admin/system-health')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>시스템 상태</h2>
        <button onClick={reload} style={styles.refreshBtn}>↻ 새로고침</button>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}

      {loading && (
        <div style={{ color: '#888', padding: 24 }}>상태 확인 중...</div>
      )}

      {data && (
        <div style={styles.grid}>
          {/* DB 상태 */}
          <MetricCard title="데이터베이스" status={data.db?.status}>
            {data.db?.status === 'ok' ? (
              <>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>응답 시간</span>
                  <span style={{
                    ...styles.metricValue,
                    color: data.db.latency_ms < 50 ? '#10b981' : data.db.latency_ms < 200 ? '#f59e0b' : '#ef4444',
                  }}>{data.db.latency_ms} ms</span>
                </div>
              </>
            ) : (
              <div style={{ color: '#e53e3e', fontSize: 13 }}>{data.db?.error}</div>
            )}
          </MetricCard>

          {/* 프롬프트 스토어 */}
          <MetricCard title="프롬프트 스토어" status={data.prompt_store?.status}>
            {data.prompt_store?.status === 'ok' ? (
              <>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>등록된 프롬프트</span>
                  <span style={styles.metricValue}>{data.prompt_store.count}개</span>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>수정된 프롬프트</span>
                  <span style={{
                    ...styles.metricValue,
                    color: data.prompt_store.modified > 0 ? '#f59e0b' : '#10b981',
                  }}>{data.prompt_store.modified}개</span>
                </div>
              </>
            ) : (
              <div style={{ color: '#e53e3e', fontSize: 13 }}>{data.prompt_store?.error}</div>
            )}
          </MetricCard>

          {/* 데이터 품질 */}
          <MetricCard title="데이터 품질" status={
            data.data_quality?.vlm_unprocessed_photos > 0 ||
            data.data_quality?.users_without_diary > 0 ||
            data.data_quality?.users_without_avatar > 0
              ? 'warn' : 'ok'
          }>
            {data.data_quality?.error ? (
              <div style={{ color: '#e53e3e', fontSize: 13 }}>{data.data_quality.error}</div>
            ) : (
              <>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>VLM 미처리 사진</span>
                  <span style={{
                    ...styles.metricValue,
                    color: data.data_quality.vlm_unprocessed_photos > 0 ? '#ef4444' : '#10b981',
                  }}>{data.data_quality.vlm_unprocessed_photos}장</span>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>일기 없는 사용자</span>
                  <span style={{
                    ...styles.metricValue,
                    color: data.data_quality.users_without_diary > 0 ? '#f59e0b' : '#10b981',
                  }}>{data.data_quality.users_without_diary}명</span>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>아바타 없는 사용자</span>
                  <span style={{
                    ...styles.metricValue,
                    color: data.data_quality.users_without_avatar > 0 ? '#f59e0b' : '#10b981',
                  }}>{data.data_quality.users_without_avatar}명</span>
                </div>
              </>
            )}
          </MetricCard>
        </div>
      )}
    </div>
  )
}

const styles = {
  refreshBtn: {
    padding: '5px 14px', background: '#6c63ff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  metricRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #f5f5f5',
  },
  metricLabel: { fontSize: 14, color: '#666' },
  metricValue: { fontSize: 16, fontWeight: 700, color: '#222' },
}
