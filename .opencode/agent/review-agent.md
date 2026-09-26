---
description: Независимое ревью пакета — живой проект через MCP, каталог и экспорт; ничего не чинит, пишет вердикт в журнал
mode: all
permission:
  "*": deny
  read:
    "*": allow
    "*.env": deny
    "*.env.*": deny
  glob: allow
  grep: allow
  list: allow
  webfetch: allow
  websearch: allow
  skill: allow
  todowrite: allow
  question: allow
  task: deny
  edit:
    "*": deny
    "docs/work/*.md": allow
  bash:
    "*": allow
    "git *": deny
    "git status": allow
    "git status *": allow
    "git diff": allow
    "git diff *": allow
    "git log": allow
    "git log *": allow
    "git show": allow
    "git show *": allow
    "git rev-parse *": allow
    "git ls-files *": allow
    "rm *": deny
    "curl -X POST *": deny
    "curl -X PATCH *": deny
    "curl -X PUT *": deny
    "curl -X DELETE *": deny
  qadam-flow_ap_flow_structure: allow
  qadam-flow_ap_read_step_code: allow
  qadam-flow_ap_list_flows: allow
  qadam-flow_ap_list_runs: allow
  qadam-flow_ap_get_run: allow
  qadam-flow_ap_list_tables: allow
  qadam-flow_ap_find_records: allow
  qadam-flow_ap_list_connections: allow
  qadam-flow_ap_list_variables: allow
  qadam-flow_ap_export_flow: allow
  qadam-flow_ap_export_table: allow
  qadam-flow_ap_validate_flow: allow
  qadam-flow_ap_validate_step_config: allow
  qadam-flow_ap_research_pieces: allow
  qadam-flow_ap_get_piece_props: allow
  qadam-flow_ap_resolve_property_options: allow
  qadam-flow_ap_resolve_property_chain: allow
  app-flow-events-dev_ap_flow_structure: allow
  app-flow-events-dev_ap_read_step_code: allow
  app-flow-events-dev_ap_list_flows: allow
  app-flow-events-dev_ap_list_runs: allow
  app-flow-events-dev_ap_get_run: allow
  app-flow-events-dev_ap_list_tables: allow
  app-flow-events-dev_ap_find_records: allow
  app-flow-events-dev_ap_list_connections: allow
  app-flow-events-dev_ap_list_variables: allow
  app-flow-events-dev_ap_export_flow: allow
  app-flow-events-dev_ap_export_table: allow
  app-flow-events-dev_ap_validate_flow: allow
  app-flow-events-dev_ap_validate_step_config: allow
  app-flow-events-dev_ap_research_pieces: allow
  app-flow-events-dev_ap_get_piece_props: allow
  app-flow-events-dev_ap_resolve_property_options: allow
  app-flow-events-dev_ap_resolve_property_chain: allow
  app-flow-events-prod_ap_flow_structure: allow
  app-flow-events-prod_ap_read_step_code: allow
  app-flow-events-prod_ap_list_flows: allow
  app-flow-events-prod_ap_list_runs: allow
  app-flow-events-prod_ap_get_run: allow
  app-flow-events-prod_ap_list_tables: allow
  app-flow-events-prod_ap_find_records: allow
  app-flow-events-prod_ap_list_connections: allow
  app-flow-events-prod_ap_list_variables: allow
  app-flow-events-prod_ap_export_flow: allow
  app-flow-events-prod_ap_export_table: allow
  app-flow-events-prod_ap_validate_flow: allow
  app-flow-events-prod_ap_validate_step_config: allow
  app-flow-events-prod_ap_research_pieces: allow
  app-flow-events-prod_ap_get_piece_props: allow
  app-flow-events-prod_ap_resolve_property_options: allow
  app-flow-events-prod_ap_resolve_property_chain: allow
---
Источник правды о роли — `docs/agents/review-agent.md`. Прочитай его целиком первым действием.
Твой протокол — `docs/work/REVIEW-CHECKLIST.md`; вход — номер пакета в задаче.
