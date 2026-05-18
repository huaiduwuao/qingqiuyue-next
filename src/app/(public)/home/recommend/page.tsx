'use client';

import React, { useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import { useApp } from '@/contexts/AppContext';
import { moduleList } from '@/apis/home';

export default function HomeRecommendPage() {
  const { currentUser, dict, modules } = useApp();
  const [typeList, setTypeList] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<any>({});
  const [moduleData, setModuleData] = useState<any[]>([]);

  useEffect(() => {
    if (dict && dict.length > 0) {
      const types = dict.filter((item: any) => item.type === 'module-type')[0]?.dataList || [];
      setTypeList(types);
      if (types.length > 0 && !selectedType.id) {
        setSelectedType(types[0]);
      }
    }
  }, [dict]);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const res = await moduleList({});
        setModuleData(res.data?.list || []);
      } catch (err) {
        console.error('Failed to fetch modules:', err);
      }
    };
    fetchModules();
  }, []);

  const filteredModules = moduleData.filter((item: any) => item.type === selectedType?.id);

  const handleTypeChange = (event: React.SyntheticEvent, newValue: any) => {
    const types = dict?.filter((item: any) => item.type === 'module-type')[0]?.dataList || [];
    setSelectedType(types[newValue] || {});
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          首页推荐
        </Typography>

        {typeList.length > 0 && (
          <Tabs
            value={typeList.findIndex((t) => t.id === selectedType?.id) || 0}
            onChange={handleTypeChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 3 }}
          >
            {typeList.map((type: any) => (
              <Tab key={type.id} label={type.label || type.name} />
            ))}
          </Tabs>
        )}

        <Grid container spacing={3}>
          {moduleData.map((item: any) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{item.title}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {item.subtitle || '暂无描述'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {moduleData.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                暂无内容
              </Typography>
            </Grid>
          )}
        </Grid>
      </Box>
    </Container>
  );
}
