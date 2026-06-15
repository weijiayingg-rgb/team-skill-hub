/**
 * SceneCreate - 创建场景页面
 *
 * 向导式流程：选规范 → 选技能 → 选自动化 → 命名保存
 * 所有选项从已有资源中勾选，无需上传文件。
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormGroup from '@mui/material/FormGroup';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ExtensionIcon from '@mui/icons-material/Extension';
import BoltIcon from '@mui/icons-material/Bolt';
import { colors } from '../theme';
import apiClient from '../api/client';

const STEPS = ['选择规范', '选择技能', '选择自动化', '命名保存'];
const SCENE_ACCENT = '#7C3AED';

export default function SceneCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 可选的资源列表
  const [rulesList, setRulesList] = useState([]);
  const [skillsList, setSkillsList] = useState([]);
  const [hooksList, setHooksList] = useState([]);
  const [fetchingResources, setFetchingResources] = useState(true);

  // 用户选择
  const [selectedRules, setSelectedRules] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedHook, setSelectedHook] = useState(null);

  // 命名
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 加载可选资源
  useEffect(() => {
    Promise.all([
      apiClient.get('/resources?type=rules&pageSize=100'),
      apiClient.get('/resources?type=skill&pageSize=200'),
      apiClient.get('/resources?type=hook&pageSize=50'),
    ]).then(([rulesRes, skillsRes, hooksRes]) => {
      setRulesList(rulesRes.data || []);
      setSkillsList(skillsRes.data || []);
      setHooksList(hooksRes.data || []);
    }).catch(err => setError(err.message || '加载资源失败'))
      .finally(() => setFetchingResources(false));
  }, []);

  const handleSubmit = async () => {
    if (!name || !displayName) {
      setError('请输入场景名称');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name,
        display_name: displayName,
        description,
        rules_id: selectedRules,
        skills: selectedSkills,
        hooks_id: selectedHook,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      const res = await apiClient.post('/scenes', body);
      navigate(`/scenes/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSkill = (skillId) => {
    setSelectedSkills(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const canNext = () => {
    if (step === 0) return selectedRules !== null;
    if (step === 1) return selectedSkills.length > 0;
    return true;
  };

  if (fetchingResources) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={48} sx={{ color: SCENE_ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontFamily: '"Play", sans-serif', color: colors.textPrimary, mb: 1 }}>
        创建场景
      </Typography>
      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
        选择已有的规范、技能和自动化钩子，组装成一个企业工作流场景
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map(label => (
          <Step key={label}>
            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.85rem' } }}>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Step 0: 选择规范 */}
      {step === 0 && (
        <Paper sx={{ p: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoFixHighIcon sx={{ color: SCENE_ACCENT }} />
            <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif' }}>选择行为规范 (Rules)</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: colors.textMuted, mb: 2 }}>
            选一个行为规范作为这个场景的"规则手册"，AI 会按照这个规范执行。
          </Typography>
          {rulesList.length === 0 ? (
            <Typography sx={{ color: colors.textMuted, py: 4, textAlign: 'center' }}>
              暂无可用的规范资源，请先上传 Rules 类型的资源。
            </Typography>
          ) : (
            <FormControl component="fieldset" fullWidth>
              <RadioGroup value={selectedRules || ''} onChange={e => setSelectedRules(parseInt(e.target.value))}>
                {rulesList.map(rule => (
                  <FormControlLabel
                    key={rule.id}
                    value={rule.id}
                    control={<Radio sx={{ color: SCENE_ACCENT, '&.Mui-checked': { color: SCENE_ACCENT } }} />}
                    label={
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{rule.display_name}</Typography>
                        <Typography variant="body2" sx={{ color: colors.textMuted, fontSize: '0.8rem' }}>
                          {rule.description?.slice(0, 100)}
                        </Typography>
                      </Box>
                    }
                    sx={{ mb: 1, p: 1, borderRadius: 1, '&:hover': { bgcolor: 'rgba(124, 58, 237, 0.03)' } }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          )}
        </Paper>
      )}

      {/* Step 1: 选择技能 */}
      {step === 1 && (
        <Paper sx={{ p: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ExtensionIcon sx={{ color: SCENE_ACCENT }} />
            <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif' }}>选择技能 (Skills)</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: colors.textMuted, mb: 2 }}>
            勾选这个场景需要的技能（可多选）。已选 <Chip label={selectedSkills.length} size="small" sx={{ bgcolor: 'rgba(124, 58, 237, 0.1)', color: SCENE_ACCENT, fontWeight: 700 }} /> 个
          </Typography>
          {skillsList.length === 0 ? (
            <Typography sx={{ color: colors.textMuted, py: 4, textAlign: 'center' }}>
              暂无可用的技能资源，请先上传 Skill 类型的资源。
            </Typography>
          ) : (
            <FormGroup>
              {skillsList.map(skill => (
                <FormControlLabel
                  key={skill.id}
                  control={
                    <Checkbox
                      checked={selectedSkills.includes(skill.id)}
                      onChange={() => toggleSkill(skill.id)}
                      sx={{ color: SCENE_ACCENT, '&.Mui-checked': { color: SCENE_ACCENT } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{skill.display_name}</Typography>
                      <Typography variant="body2" sx={{ color: colors.textMuted, fontSize: '0.8rem' }}>
                        {skill.description?.slice(0, 80)}
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 0.5, p: 0.5, borderRadius: 1, width: '100%', '&:hover': { bgcolor: 'rgba(124, 58, 237, 0.03)' } }}
                />
              ))}
            </FormGroup>
          )}
        </Paper>
      )}

      {/* Step 2: 选择自动化 */}
      {step === 2 && (
        <Paper sx={{ p: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BoltIcon sx={{ color: SCENE_ACCENT }} />
            <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif' }}>选择自动化钩子 (Hook) — 可选</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: colors.textMuted, mb: 2 }}>
            可选。选一个自动化钩子，在特定时机自动触发（如提交代码前检查）。
          </Typography>
          {hooksList.length === 0 ? (
            <Typography sx={{ color: colors.textMuted, py: 4, textAlign: 'center' }}>
              暂无可用的 Hook 资源，可以跳过这一步。
            </Typography>
          ) : (
            <FormControl component="fieldset" fullWidth>
              <RadioGroup value={selectedHook || ''} onChange={e => setSelectedHook(e.target.value ? parseInt(e.target.value) : null)}>
                <FormControlLabel
                  value=""
                  control={<Radio sx={{ color: colors.textMuted }} />}
                  label={<Typography sx={{ color: colors.textMuted }}>不选（跳过）</Typography>}
                />
                {hooksList.map(hook => (
                  <FormControlLabel
                    key={hook.id}
                    value={hook.id}
                    control={<Radio sx={{ color: SCENE_ACCENT, '&.Mui-checked': { color: SCENE_ACCENT } }} />}
                    label={
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{hook.display_name}</Typography>
                        <Typography variant="body2" sx={{ color: colors.textMuted, fontSize: '0.8rem' }}>
                          {hook.description?.slice(0, 80)}
                        </Typography>
                      </Box>
                    }
                    sx={{ mb: 1, p: 1, borderRadius: 1, '&:hover': { bgcolor: 'rgba(124, 58, 237, 0.03)' } }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          )}
        </Paper>
      )}

      {/* Step 3: 命名保存 */}
      {step === 3 && (
        <Paper sx={{ p: 3, bgcolor: colors.bgWhite, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontFamily: '"Play", sans-serif', mb: 3 }}>命名你的场景</Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="场景标识 (name)"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="如: data-dev-workflow"
              helperText="英文标识，用于 CLI 安装，如 skhub install data-dev-workflow"
              required
              fullWidth
            />
            <TextField
              label="场景名称"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="如: 数据开发场景"
              helperText="在页面上显示的名称"
              required
              fullWidth
            />
            <TextField
              label="描述"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="描述这个场景的用途..."
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="标签"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="多个标签用逗号分隔，如: 数据平台组, DataAPI, 数据入库"
              helperText="按团队/工具/流程三个维度打标签"
              fullWidth
            />

            {/* 预览 */}
            <Box sx={{ bgcolor: 'rgba(124, 58, 237, 0.03)', p: 2, borderRadius: 2, mt: 1 }}>
              <Typography variant="subtitle2" sx={{ color: SCENE_ACCENT, mb: 1 }}>场景预览</Typography>
              <Typography variant="body2">
                📋 规范: {rulesList.find(r => r.id === selectedRules)?.display_name || '未选择'}
              </Typography>
              <Typography variant="body2">
                🔧 技能: {selectedSkills.map(id => skillsList.find(s => s.id === id)?.display_name).filter(Boolean).join(', ') || '未选择'}
              </Typography>
              <Typography variant="body2">
                ⚡ 自动化: {hooksList.find(h => h.id === selectedHook)?.display_name || '无'}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* 底部按钮 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => step > 0 ? setStep(step - 1) : navigate('/scenes')}
          sx={{ textTransform: 'none' }}
        >
          {step === 0 ? '取消' : '上一步'}
        </Button>

        {step < 3 ? (
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            sx={{
              bgcolor: SCENE_ACCENT,
              '&:hover': { bgcolor: '#6D28D9' },
              '&.Mui-disabled': { bgcolor: '#E5E7EB', color: colors.textMuted },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            下一步
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<CheckIcon />}
            onClick={handleSubmit}
            disabled={submitting || !name || !displayName}
            sx={{
              bgcolor: SCENE_ACCENT,
              '&:hover': { bgcolor: '#6D28D9' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {submitting ? '创建中...' : '创建场景'}
          </Button>
        )}
      </Box>
    </Box>
  );
}