'use client';

import { useCallback, useEffect, useState } from 'react';

interface AIComment {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number | null;
  content: string;
  time: string;
  votes: number;
  isAiGenerated: true;
}

interface AICommentsProps {
  movieName: string;
  movieInfo?: string;
}

export default function AIComments({ movieName, movieInfo }: AICommentsProps) {
  const [comments, setComments] = useState<AIComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      console.log('正在生成AI评论...');
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        name: movieName,
        count: '10',
        _t: Date.now().toString(), // 添加时间戳防止缓�?      });

      if (movieInfo) {
        params.append('info', movieInfo);
      }

      const response = await fetch(`/api/ai-comments?${params.toString()}`, {
        cache: 'no-store', // 禁用缓存
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '生成AI评论失败');
      }

      const data = await response.json();
      console.log('AI评论生成成功:', data.comments.length);

      setComments(data.comments);
    } catch (err) {
      console.error('生成AI评论失败:', err);
      setError(err instanceof Error ? err.message : '生成AI评论失败');
    } finally {
      setLoading(false);
    }
  }, [movieName, movieInfo]);

  useEffect(() => {
    // 重置状态当 movieName 变化�?    setHasStartedLoading(false);
    setComments([]);
    setLoading(false);
    setError(null);
  }, [movieName]);

  const startLoading = () => {
    console.log('开始生成AI评论');
    setHasStartedLoading(true);
    fetchComments();
  };

  const regenerate = () => {
    console.log('重新生成AI评论');
    fetchComments();
  };

  // 星级渲染
  const renderStars = (rating: number | null) => {
    if (rating === null) return null;

    return (
      <div className='flex items-center gap-0.5'>
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className='w-4 h-4'
            fill={star <= rating ? '#3b82f6' : '#e0e0e0'}
            viewBox='0 0 24 24'
          >
            <path d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' />
          </svg>
        ))}
      </div>
    );
  };

  // 初始状态：显示生成按钮
  if (!hasStartedLoading) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <div className='text-gray-500 dark:text-gray-400 mb-4'>
          <svg
            className='w-16 h-16 mx-auto mb-4 opacity-50'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1.5}
              d='M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
            />
          </svg>
          <p className='text-center'>点击生成AI评论</p>
          <p className='text-xs text-center mt-2 text-gray-400'>
            基于影片信息和网络资料生�?          </p>
        </div>
        <button
          onClick={startLoading}
          className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M13 10V3L4 14h7v7l9-11h-7z'
            />
          </svg>
          生成AI评论
        </button>
      </div>
    );
  }

  if (loading && comments.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3'></div>
        <span className='text-gray-600 dark:text-gray-400'>AI正在生成评论...</span>
        <span className='text-xs text-gray-500 dark:text-gray-500 mt-2'>
          这可能需要几秒钟
        </span>
      </div>
    );
  }

  if (error && comments.length === 0) {
    return (
      <div className='text-center py-12'>
        <div className='text-red-500 mb-2'>�?/div>
        <p className='text-gray-600 dark:text-gray-400 mb-1'>{error}</p>
        <p className='text-xs text-gray-500 dark:text-gray-500 mb-4'>
          请检查管理面板的AI配置是否正确
        </p>
        <button
          onClick={startLoading}
          className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* 头部统计和操�?*/}
      <div className='flex items-center justify-between'>
        <div className='text-sm text-gray-600 dark:text-gray-400'>
          已生�?{comments.length} 条AI评论
        </div>
        <button
          onClick={regenerate}
          disabled={loading}
          className='text-sm px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1'
        >
          <svg
            className='w-4 h-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
            />
          </svg>
          {loading ? '生成�?..' : '重新生成'}
        </button>
      </div>

      {/* 评论列表 */}
      <div className='space-y-4'>
        {comments.map((comment) => (
          <div
            key={comment.id}
            className='bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border border-blue-100 dark:border-blue-900/30'
          >
            {/* 用户信息 */}
            <div className='flex items-start gap-3 mb-3'>
              {/* 头像 */}
              <div className='flex-shrink-0'>
                <img
                  src={comment.userAvatar}
                  alt={comment.userName}
                  className='w-10 h-10 rounded-full'
                />
              </div>

              {/* 用户名和评分 */}
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className='font-medium text-gray-900 dark:text-white'>
                    {comment.userName}
                  </span>
                  {renderStars(comment.rating)}
                  {/* AI标识 */}
                  <span className='inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-full'>
                    <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M13 10V3L4 14h7v7l9-11h-7z' />
                    </svg>
                    AI生成
                  </span>
                </div>

                {/* 时间 */}
                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  {comment.time}
                </div>
              </div>

              {/* 有用�?*/}
              {comment.votes > 0 && (
                <div className='flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400'>
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5'
                    />
                  </svg>
                  <span>{comment.votes}</span>
                </div>
              )}
            </div>

            {/* 评论内容 */}
            <div className='text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap'>
              {comment.content}
            </div>
          </div>
        ))}
      </div>

      {/* 提示信息 */}
      <div className='text-center text-xs text-gray-500 dark:text-gray-400 py-2 border-t border-gray-200 dark:border-gray-700'>
        以上评论由AI基于影片信息和网络资料生成，仅供参�?      </div>
    </div>
  );
}
