import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { listenApiError, type ApiErrorEventDetail } from '@/api/api-error';

export default function ApiErrorSnackbar() {
  const [detail, setDetail] = useState<ApiErrorEventDetail | null>(null);

  useEffect(() => {
    return listenApiError((nextDetail) => {
      setDetail(nextDetail);
    });
  }, []);

  return (
    <Snackbar
      open={detail !== null}
      autoHideDuration={3000}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      onClose={() => setDetail(null)}
    >
      <Alert
        severity={detail?.severity ?? 'error'}
        variant="filled"
        onClose={() => setDetail(null)}
      >
        {detail?.message}
      </Alert>
    </Snackbar>
  );
}
