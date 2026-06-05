'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';

const cards = [3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A', 2, '小王', '大王'];

export default function HomeGoujiPage() {
  const [left, setLeft] = useState([6, 8, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 4, 4]);
  const [pLeft, setPLeft] = useState([33, 33, 33, 33, 33, 33]);

  const onChange = (type: 'plus' | 'minus', index: number, p: number) => {
    if (type === 'plus') {
      left[index] = left[index] - 1;
      pLeft[p] = pLeft[p] - 1;
    } else {
      left[index] = left[index] + 1;
      pLeft[p] = pLeft[p] - 1;
    }
    setLeft([...left]);
    setPLeft([...pLeft]);
  };

  const onPChange = (value: number | null, index: number) => {
    if (value !== null) {
      pLeft[index] = value;
      setPLeft([...pLeft]);
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 3 }}>够级</Typography>
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: 80, fontWeight: 'bold', bgcolor: 'action.hover' }}>牌</TableCell>
                <TableCell align="center" sx={{ width: 80, fontWeight: 'bold', bgcolor: 'action.hover' }}>剩余</TableCell>
                {[1, 2, 3, 4, 5, 6].map((player) => (
                  <TableCell key={player} align="center" sx={{ fontWeight: 'bold', bgcolor: 'action.hover' }}>
                    玩家{player}
                    <TextField
                      type="number"
                      size="small"
                      value={pLeft[player - 1]}
                      onChange={(e) => onPChange(parseInt(e.target.value) || 0, player - 1)}
                      slotProps={{ input: { style: { textAlign: 'center', width: 50 } } }}
                      sx={{ ml: 1 }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {cards.map((card, cardIndex) => (
                <TableRow key={cardIndex}>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>{card}</TableCell>
                  <TableCell align="center">{left[cardIndex]}</TableCell>
                  {[0, 1, 2, 3, 4, 5].map((player) => (
                    <TableCell key={player} align="center">
                      <Box sx={{ cursor: 'pointer', color: 'primary.main' }} onClick={() => onChange('minus', cardIndex, player)}>
                        -
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Container>
  );
}