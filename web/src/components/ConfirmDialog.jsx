import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = '确认', cancelText = '取消' }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontFamily: '"Play", sans-serif' }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} sx={{ color: 'text.secondary' }}>{cancelText}</Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}