import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Box from '@mui/material/Box';

export default function MarkdownViewer({ content }) {
  if (!content) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
        暂无内容
      </Box>
    );
  }

  return (
    <Box className="markdown-body" sx={{ p: 2 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </Box>
  );
}