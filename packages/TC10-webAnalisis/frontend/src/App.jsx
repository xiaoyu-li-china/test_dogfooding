import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = '/api'

function App() {
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [filters, setFilters] = useState({
    sentiment_label: '',
    user_id: '',
    product_id: '',
    page: 1,
    page_size: 20
  })
  
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 0
  })

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats/sentiment`)
      setStats(response.data)
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchReviews = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = {}
      if (filters.sentiment_label) params.sentiment_label = filters.sentiment_label
      if (filters.user_id) params.user_id = filters.user_id
      if (filters.product_id) params.product_id = filters.product_id
      params.page = filters.page
      params.page_size = filters.page_size

      const response = await axios.get(`${API_BASE}/reviews`, { params })
      const data = response.data
      setReviews(data.reviews)
      setPagination({
        total: data.total,
        page: data.page,
        page_size: data.page_size,
        total_pages: data.total_pages
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch reviews')
      console.error('Error fetching reviews:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [filters])

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
      page: 1
    }))
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setFilters(prev => ({ ...prev, page: newPage }))
    }
  }

  const handleRefresh = () => {
    fetchStats()
    fetchReviews()
  }

  const renderRating = (rating) => {
    if (!rating) return null
    return (
      <div className="rating">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={`star ${star <= rating ? '' : 'empty'}`}>
            ★
          </span>
        ))}
      </div>
    )
  }

  const getSentimentClass = (label) => {
    if (!label) return 'pending'
    return label.toLowerCase()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="container">
      <div className="header">
        <h1>📊 Review Admin Dashboard</h1>
      </div>

      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <h3>Total Reviews</h3>
            <div className="value">{stats.total}</div>
          </div>
          <div className="stat-card positive">
            <h3>Positive</h3>
            <div className="value">{stats.positive}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {stats.total > 0 ? (stats.positive_rate * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="stat-card negative">
            <h3>Negative</h3>
            <div className="value">{stats.negative}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {stats.total > 0 ? (stats.negative_rate * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="stat-card pending">
            <h3>Pending</h3>
            <div className="value">{stats.pending}</div>
          </div>
          <div className="stat-card failed">
            <h3>Failed</h3>
            <div className="value">{stats.failed}</div>
          </div>
        </div>
      )}

      <div className="filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Sentiment</label>
            <select
              value={filters.sentiment_label}
              onChange={(e) => handleFilterChange('sentiment_label', e.target.value)}
            >
              <option value="">All</option>
              <option value="POSITIVE">Positive</option>
              <option value="NEGATIVE">Negative</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>User ID</label>
            <input
              type="number"
              placeholder="Filter by user"
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>Product ID</label>
            <input
              type="number"
              placeholder="Filter by product"
              value={filters.product_id}
              onChange={(e) => handleFilterChange('product_id', e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>Page Size</label>
            <select
              value={filters.page_size}
              onChange={(e) => handleFilterChange('page_size', parseInt(e.target.value))}
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>&nbsp;</label>
            <button className="refresh-btn" onClick={handleRefresh}>
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="no-reviews">
          <p>No reviews found</p>
        </div>
      ) : (
        <>
          <div className="reviews-list">
            {reviews.map(review => (
              <div key={review.id} className="review-item">
                <div className="review-header">
                  <div className="review-meta">
                    <span>👤 User: {review.user_id}</span>
                    <span>📦 Product: {review.product_id}</span>
                    <span>🆔 ID: {review.id}</span>
                  </div>
                  <span className={`sentiment-badge ${getSentimentClass(review.sentiment_label)}`}>
                    {review.sentiment_label || 'PENDING'}
                    {review.sentiment_score && ` (${(review.sentiment_score * 100).toFixed(0)}%)`}
                  </span>
                </div>
                
                <div className="review-content">
                  {review.content}
                </div>
                
                <div className="review-footer">
                  {renderRating(review.rating)}
                  <span>📅 {formatDate(review.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          {pagination.total_pages > 1 && (
            <div className="pagination">
              <button
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                ← Previous
              </button>
              
              {Array.from({ length: pagination.total_pages }, (_, i) => i + 1)
                .filter(page => {
                  if (pagination.total_pages <= 7) return true
                  if (page === 1 || page === pagination.total_pages) return true
                  if (Math.abs(page - pagination.page) <= 1) return true
                  return false
                })
                .map(page => (
                  <button
                    key={page}
                    className={page === pagination.page ? 'active' : ''}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ))
              }
              
              <button
                disabled={pagination.page === pagination.total_pages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
